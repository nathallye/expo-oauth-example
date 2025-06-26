import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";

import { AuthUser } from "@/dtos/auth-user";
import { tokenCache } from "@/utils/cache";
import { BASE_URL, TOKEN_KEY_NAME } from "@/utils/constants";
import {
  AuthError,
  AuthRequestConfig,
  DiscoveryDocument,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import * as jose from "jose";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextProps {
  isLoading: boolean;
  user: AuthUser | null;
  error: AuthError | null;
  signIn: () => void;
  signOut: () => void;
  fetchWithAuth: (url: string, options: RequestInit) => Promise<Response>;
}

export const AuthContext = React.createContext<AuthContextProps>({
  isLoading: false,
  user: null,
  error: null as AuthError | null,
  signIn: () => {},
  signOut: () => {},
  fetchWithAuth: (url: string, options: RequestInit) =>
    Promise.resolve(new Response()),
});

interface AuthProviderProps {
  children: React.ReactNode;
}

const config: AuthRequestConfig = {
  clientId: "google",
  scopes: ["openid", "profile", "email"],
  redirectUri: makeRedirectUri(),
};

const appleConfig: AuthRequestConfig = {
  clientId: "apple",
  scopes: ["name", "email"],
  redirectUri: makeRedirectUri(),
};

// Our OAuth flow uses a server-side approach for enranced security.
// 1. Client initiates the OAuth flow with Google through our server.
// 2. Google redirects to our server with an authorization code (/api/auth/authorize endpoint).
// 3. Our server handles the OAuth flow with Google using server-side credentials and exchanges the authorization code for tokens (/api/auth/token endpoint).
// 4. Client receives the tokens from our server and can use them for authenticated requests.
// 5. Client exchanges the code for tokens with our server using the /api/auth/token endpoint.
// 6. Server uses its credentials to exchange the code for tokens with Google and returns them to the client.
const discovery: DiscoveryDocument = {
  // URL where users are redirected to login with Google and grant authorization.
  // Our server handles the OAuth flow with Google and returns the authorization code.
  authorizationEndpoint: `${BASE_URL}/api/auth/authorize`,
  // URL where our server exchanges the authorization code for tokens.
  // Our server uses its own credentials (client ID and secret) to securely exchange the code for tokens with Google.
  tokenEndpoint: `${BASE_URL}/api/auth/token`,
};

const appleDiscovery: DiscoveryDocument = {
  authorizationEndpoint: `${BASE_URL}/api/auth/apple/authorize`,
  tokenEndpoint: `${BASE_URL}/api/auth/apple/token`,
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [request, response, promptAsyn] = useAuthRequest(config, discovery);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    responseHandler();
  }, [response]);

  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true);

      try {
        if (isWeb) {
          const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
            method: "GET",
            credentials: "include", // include cookies for web
          });

          if (!sessionResponse.ok) {
            const text = await sessionResponse.text();
            console.error(
              "Failed to fetch session:",
              sessionResponse.status,
              text
            );

            return;
          }

          const userData = await sessionResponse.json();
          setUser(userData);
        } else {
          // For native platforms, we can try to use restore storage token first
          const storedAccessToken = await tokenCache?.getToken(TOKEN_KEY_NAME);

          // Get refresh token if needed
          if (storedAccessToken) {
            try {
              const decodedToken = jose.decodeJwt(storedAccessToken);
              const expiration = decodedToken.exp as number;
              const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

              const storedUserData: AuthUser = {
                id: decodedToken.sub as string,
                email: decodedToken.email as string,
                name: decodedToken.name as string,
                picture: decodedToken.picture as string | undefined,
                given_name: decodedToken.given_name as string | undefined,
                family_name: decodedToken.family_name as string | undefined,
                email_verified: decodedToken.email_verified as
                  | boolean
                  | undefined,
                provider: decodedToken.provider as string | undefined,
                exp: decodedToken.exp,
                cookieExpiration: decodedToken.cookieExpiration as
                  | number
                  | undefined,
              };

              if (expiration > currentTime) {
                // Access token is still valid
                console.log("Access token is still valid.");

                setAccessToken(storedAccessToken);
                setUser(storedUserData);
              } else {
                setUser(null);
                tokenCache?.deleteToken(TOKEN_KEY_NAME);
              }
              // Uncomment this to handle refresh token logic
              // } else  if (storedRefreshToken) {
              //   // access token is expired, we need to refresh it
              //   console.log("Access token is expired, trying to restore...");
              //   setRefreshToken(storedRefreshToken);
              //   await refreshAccessToken(storedRefreshToken);
              // }
            } catch (error) {
              console.error("Error restoring access token:", error);
            }
          } else {
            console.log("User is not authenticated, no access token found.");
          }
        }
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [isWeb]);

  const responseHandler = async () => {
    if (response?.type === "success") {
      const { code } = response.params;

      //  Once we have the authorization code, we can exchange it for tokens with our server(backend).
      try {
        setIsLoading(true);

        // Exchange the code
        // This formData is going to be sent to api/auth/token endpoint, and it's going to contain the code we wanna exchange and the platform is sending this request
        const formData = new FormData();
        formData.append("code", code);

        if (isWeb) {
          // We don't need to specify when it's native, because on the api side we're going to say if the request doesn't have platform, it's native
          formData.append("platform", "web");
        }

        // Get the code verifier from the request object
        // This is used to verify the request and prevent CSRF attacks
        if (request?.codeVerifier) {
          formData.append("code_verifier", request.codeVerifier);
        } else {
          console.warn("No code verifier found in request object");
        }

        const tokenResponse = await fetch(`${BASE_URL}/api/auth/token`, {
          method: "POST",
          body: formData,
          credentials: isWeb ? "include" : "same-origin", // Include cookies for web, same-origin for native
        });

        // Save token to local storage
        if (isWeb) {
          // For web the server sets the token in http-only cookies,
          // so we don't need to handle it here, just get the user data from the response
          const userDataResponse = await tokenResponse.json();

          if (userDataResponse.success) {
            // Fetch the session to get the user data
            // This ensures we have the latest user data
            const sessionResponse = await fetch(
              `${BASE_URL}/api/auth/session`,
              {
                method: "GET",
                credentials: "include", // Include cookies for web
              }
            );

            if (!sessionResponse.ok) {
              const text = await sessionResponse.text();
              console.error(
                "Failed to fetch session:",
                sessionResponse.status,
                text
              );

              return;
            }

            const sessionData = await sessionResponse.json();
            setUser(sessionData.user);
          }
        } else {
          // For native platforms, we can use the response directly
          if (!tokenResponse.ok) {
            const text = await tokenResponse.text();
            console.error("Token exchange failed:", tokenResponse.status, text);
            return;
          }

          const tokenData = await tokenResponse.json();
          const { accessToken, user } = tokenData;

          if (!accessToken) {
            console.error("No access token received");
            return;
          }

          setAccessToken(accessToken);

          // Save the access token to secure storage
          tokenCache?.saveToken(TOKEN_KEY_NAME, accessToken);

          console.log("Access token saved:", accessToken);

          const decodedToken = jose.decodeJwt(accessToken);

          const userData: AuthUser = {
            id: decodedToken.sub as string,
            email: decodedToken.email as string,
            name: decodedToken.name as string,
            picture: decodedToken.picture as string | undefined,
            given_name: decodedToken.given_name as string | undefined,
            family_name: decodedToken.family_name as string | undefined,
            email_verified: decodedToken.email_verified as boolean | undefined,
            provider: decodedToken.provider as string | undefined,
            exp: decodedToken.exp,
            cookieExpiration: decodedToken.cookieExpiration as
              | number
              | undefined,
          };

          setUser(userData);
        }
      } catch (error) {
        console.error("Error exchanging code for tokens:", error);
      } finally {
        setIsLoading(false);
      }
    } else if (response?.type === "error") {
      setError(response.error as AuthError);
    }
  };

  const signIn = async () => {
    try {
      if (!request) {
        console.log("Auth request is not initialized");
        return;
      }

      await promptAsyn();
    } catch (error) {
      console.error("Error during sign-in:", error);
      setError(error as AuthError);
    }
  };
  const signOut = async () => {
    if (isWeb) {
      // For web: Call logout endpoint to clear the cookie
      try {
        await fetch(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("Error during web logout:", error);
      }
    } else {
      // For native: Clear both tokens from cache
      await tokenCache?.deleteToken("accessToken");
      await tokenCache?.deleteToken("refreshToken");
    }

    // Clear state
    setUser(null);
    setAccessToken(null);
    // setRefreshToken(null);
  };

  // To protect API routes, we can use this function to fetch data with the access token
  // this is going to be a higher order function that will return a fetch method
  // that we can use to just pass the path of the API we want to call
  // and it's going to include the cookies for web or the access token for native
  // base on this we can create a middleware that will check if the token is valid
  const fetchWithAuth = async (url: string, options: RequestInit) => {
    if (isWeb) {
      // For web, we can use the fetch API with credentials included
      const response = await fetch(url, {
        ...options,
        credentials: "include", // Include cookies for web
      });

      // If the response indicates an authentication error, try to refresh the access token
      // Uncomment this to handle refresh token logic
      /*
      if (response.status === 401) {
        console.warn("API request failed with 401, trying to refresh session");

        await refreshAccessToken();

        //  If we still have a user after refreshing, retry the request
        if (user) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        }
      } */
      return response;
    } else {
      // For native we need to include the access token in the Authorization header
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${accessToken}`, // Include access token for native
        },
      });

      console.log("Response status:", response.status);
      // if we want to handle 401 errors and refresh the access token, we can do it here

      return response;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user,
        error,
        signIn,
        signOut,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
