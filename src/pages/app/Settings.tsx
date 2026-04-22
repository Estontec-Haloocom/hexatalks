import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const Settings = () => {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Settings" description="Account and integrations." />
      <div className="space-y-4 px-5 py-6 sm:p-8">
        <Card className="p-6">
          <h3 className="font-semibold">Account</h3>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold">Voice provider</h3>
          <p className="mt-1 text-sm text-muted-foreground">Vapi powers in-browser testing and outbound calls. Add your Vapi API keys to enable live calling.</p>
        </Card>
      </div>
    </>
  );
};
export default Settings;