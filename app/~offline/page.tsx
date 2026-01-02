"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <div className="bg-muted p-4 rounded-full mb-6">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold mb-2">You are offline</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        It seems you lost your internet connection. Please check your network
        and try again.
      </p>
      <Button
        onClick={() => window.location.reload()}
        className="min-w-[140px]"
      >
        Retry
      </Button>
    </div>
  );
}
