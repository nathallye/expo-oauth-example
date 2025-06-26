import { LoginForm } from "@/components/LoginForm";
import { AuthContext } from "@/providers/AuthProvider";
import { BASE_URL } from "@/utils/constants";
import { useContext, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";

export default function Index() {
  const { isLoading, user, signOut, fetchWithAuth } = useContext(AuthContext);
  const [data, setData] = useState();

  async function getProtectedData() {
    const response = await fetch(`${BASE_URL}/api/protected/data`, {
      method: "GET",
    });

    const data = await response.json();
    console.log("Protected data:", data);
    setData(data);
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <LoginForm />;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{ margin: 20, padding: 10, borderWidth: 1, borderColor: "#ccc" }}
      >
        <Text>{user.id}</Text>
        <Text>{user.name}</Text>
        <Text>{user.email}</Text>
        <Text>{user.email}</Text>
        <Button title="Sign Out" onPress={signOut} />
      </View>
      <View
        style={{ margin: 20, padding: 10, borderWidth: 1, borderColor: "#ccc" }}
      >
        <Text>{JSON.stringify(data)}</Text>
        <Button title="Fetch protected data" onPress={getProtectedData} />
      </View>
    </View>
  );
}
