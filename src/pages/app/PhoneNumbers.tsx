import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Phone } from "lucide-react";

const PhoneNumbers = () => (
  <>
    <PageHeader title="Phone numbers" description="Numbers attached for outbound calling." />
    <div className="p-8">
      <Card className="grid place-items-center p-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Phone className="h-6 w-6" /></div>
        <h3 className="mt-5 font-display text-2xl tracking-tight">No phone numbers yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">Connect Twilio in Settings to buy a number and launch real outbound calls.</p>
      </Card>
    </div>
  </>
);
export default PhoneNumbers;