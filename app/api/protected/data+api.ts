import { withAuth } from "@/utils/middleware";

// Example protected data
const mockData = {
  secretMessage: "This is protected data!",
  timestamp: new Date().toISOString(),
};

export const GET = withAuth(async (req, user) => {
  // We can use the authenticated user info in our response
  return Response.json({
    data: mockData,
    user: {
      name: user.name,
      email: user.email,
    },
  });
});
