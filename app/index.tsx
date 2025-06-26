import { LoginForm } from "@/components/LoginForm";
import { AuthContext } from "@/providers/AuthProvider";
import { useContext } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";

export default function Index() {
  const { isLoading, user, signOut } = useContext(AuthContext);

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
      </View>
      <Button title="Sign Out" onPress={() => signOut()} />
    </View>
  );
}
