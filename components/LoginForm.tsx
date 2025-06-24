import { AuthContext } from "@/providers/AuthProvider";
import React, { useContext } from "react";
import { Button, Text, View } from "react-native";

export const LoginForm = () => {
  const { signIn } = useContext(AuthContext);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Login</Text>
      <Button title="Sign in with Google" onPress={signIn} />
    </View>
  );
};
