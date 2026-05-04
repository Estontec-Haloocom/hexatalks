import { Wallet, Zap, Mic, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { cn } from "@/lib/utils";

export const WalletDropdown = () => {
  const { settings, update: updateSettings } = useDevSettings();
  const { balances, loading, refresh } = useWalletBalances();

  const currentBalance = settings?.voice_platform === "vapi" ? balances.vapi : balances.ultravox;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-1.5 border-border/40 bg-background px-2 sm:h-9 sm:gap-2.5 sm:px-3 font-semibold shadow-sm hover:bg-muted/50 transition-all">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={cn("h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full shadow-[0_0_8px_currentColor]", (currentBalance ?? 0) > 0 ? "bg-success text-success" : "bg-destructive text-destructive")} />
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold">Wallet</span>
          </div>
          <div className="h-3 w-px bg-border/40" />
          <span className="text-[10px] sm:text-xs font-mono">
            ${(currentBalance ?? 0).toFixed(2)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px] p-1.5">
        <DropdownMenuItem 
          className={cn(
            "flex items-center justify-between gap-4 py-2 cursor-pointer transition-colors",
            settings?.voice_platform === "vapi" && "bg-accent/50"
          )}
          onClick={async () => {
            await updateSettings({ voice_platform: "vapi" });
          }}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Model V</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            ${(balances.vapi ?? 0).toFixed(2)}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className={cn(
            "flex items-center justify-between gap-4 py-2 cursor-pointer transition-colors",
            settings?.voice_platform === "ultravox" && "bg-accent/50"
          )}
          onClick={async () => {
            await updateSettings({ voice_platform: "ultravox" });
          }}
        >
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Model U</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            ${(balances.ultravox ?? 0).toFixed(2)}
          </span>
        </DropdownMenuItem>
        <div className="border-t border-border mt-1.5 pt-1.5">
          <DropdownMenuItem 
            className="flex items-center gap-2 py-1.5 text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Refresh Balances
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
