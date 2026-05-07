import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const ComingSoon = ({ title, description }: { title: string; description?: string }) => (
  <div>
    <PageHeader title={title} description={description} />
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Construction className="h-10 w-10 text-primary/60" />
        <div className="text-lg font-medium text-foreground">Coming in the next iteration</div>
        <p className="max-w-md text-sm">
          The foundation for this module is in place (database schema, security, navigation). The full UI will be built in the next turn — just ask to continue with this page.
        </p>
      </CardContent>
    </Card>
  </div>
);
