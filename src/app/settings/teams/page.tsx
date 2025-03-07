"use client";

import { useEffect, useState } from "react";
import { loadSaasComponent } from "@/lib/saas-loader";
import { isSaasEnabled, isFeatureEnabled } from "@/lib/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dynamically load the TeamManagement component if SAAS is enabled
const TeamManagement = loadSaasComponent<object>(
  "components/TeamManagement",
  "teams",
  // Fallback component when SAAS is disabled
  () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Team Management</CardTitle>
        <CardDescription>
          Team management is a premium feature available in the SAAS version.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>With team management, you can:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Create and manage teams</li>
            <li>Assign team members to calendars</li>
            <li>Set permissions for team members</li>
            <li>Share calendars and tasks with your team</li>
          </ul>
          <Button className="w-full">
            <a
              href="https://fluidcalendar.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
            >
              Upgrade to SAAS Version
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
);

export default function TeamsPage() {
  const [isClient, setIsClient] = useState(false);

  // Ensure we're running on the client before checking feature flags
  useEffect(() => {
    setIsClient(true);
    console.log("SAAS Enabled:", isSaasEnabled);
    console.log("Teams Feature Enabled:", isFeatureEnabled("teams"));
    console.log("ENV Variable:", process.env.NEXT_PUBLIC_ENABLE_SAAS_FEATURES);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Team Settings PLACEHOLDER</h2>
      {/* TeamManagement will either show the SAAS component or the fallback */}
      <TeamManagement />

      {/* Additional content that's always visible */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">About Teams</h2>
        <p className="text-gray-700">
          Teams allow you to collaborate with others on calendars and tasks. You
          can share calendars, assign tasks, and manage permissions for team
          members.
        </p>
      </div>
    </div>
  );
}
