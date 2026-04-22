import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/hexatalks-logo.webp";

export const Nav = () => (
  <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center">
        <img src={logo} alt="Hexatalks" className="h-9 w-auto" />
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <a href="#features" className="hover:text-foreground">Features</a>
        <a href="#industries" className="hover:text-foreground">Industries</a>
        <a href="#how" className="hover:text-foreground">How it works</a>
        <a href="#pricing" className="hover:text-foreground">Pricing</a>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
        <Button asChild size="sm"><Link to="/auth?mode=signup">Start free</Link></Button>
      </div>
    </div>
  </header>
);
