import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { signOut } from "@/services/supabase";

export default function TabLayout() {
  const { user, clearUserData } = useFilmLogStore();

  function HeaderAccount() {
    if (!user) return null;
    return (
      <View style={{ alignItems: "flex-end", marginRight: 16 }}>
        <Text
          style={{
            fontSize: 8, color: COLORS.textDim,
            fontFamily: "Courier New", letterSpacing: 0.5,
          }}
          numberOfLines={1}
        >
          User logged in: {user.email}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            clearUserData();
          }}
        >
          <Text
            style={{
              fontSize: 8, color: COLORS.amber,
              fontFamily: "Courier New", letterSpacing: 1.5,
              textTransform: "uppercase", marginTop: 2,
            }}
          >
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: {
          fontFamily: "Courier New",
          fontSize: 9,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: {
          fontFamily: "Courier New",
          letterSpacing: 3,
          fontSize: 11,
          textTransform: "uppercase",
        },
        headerRight: () => <HeaderAccount />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Rolls",
          tabBarIcon: ({ color }) => (
            <TabIcon label="🎞" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => (
            <TabIcon label="🗺" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color }) => (
            <TabIcon label="📓" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="walks"
        options={{
          title: "Walks",
          tabBarIcon: ({ color }) => (
            <TabIcon label="🚶" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <TabIcon label="⚙" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}
