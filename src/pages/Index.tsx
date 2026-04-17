import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Sparkles,
  ArrowRight,
  Star,
  Moon,
  Sun,
  Users,
  Bot,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import RotatingEarth from "@/components/ui/wireframe-dotted-globe";
import logger from "@/lib/logger";

const Index = () => {
  logger.log("Index component rendering...");

  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGetStarted = () => {
    if (user) navigate("/solo");
    else navigate("/onboarding");
  };

  const handleFeatureClick = (feature: string) => {
    if (user) {
      switch (feature) {
        case "solo":
          navigate("/solo");
          break;
        case "multiplayer":
          navigate("/multiplayer");
          break;
        case "ai-companion":
          navigate("/ai-companion-onboarding");
          break;
        default:
          navigate("/solo");
      }
    } else {
      navigate("/onboarding");
    }
  };

  const isNight = currentTime.getHours() >= 18 || currentTime.getHours() < 6;

  const features = [
    {
      id: "solo" as const,
      title: "Solo journey",
      description: "Prompts and space for reflection—at your own pace.",
      icon: Heart,
      accent: "from-fuchsia-500/90 to-violet-600/90",
    },
    {
      id: "multiplayer" as const,
      title: "Play together",
      description: "Chat, questions, and games with someone you invite.",
      icon: Users,
      accent: "from-violet-500/90 to-indigo-600/90",
    },
    {
      id: "ai-companion" as const,
      title: "AI companion",
      description: "A thoughtful companion that adapts to your style.",
      icon: Bot,
      accent: "from-indigo-500/90 to-sky-600/90",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
      >
        <div
          className={`absolute -top-40 left-1/2 h-[520px] w-[120%] -translate-x-1/2 rounded-full blur-3xl ${
            isNight
              ? "bg-[radial-gradient(circle_at_50%_30%,rgba(139,92,246,0.35),transparent_55%)]"
              : "bg-[radial-gradient(circle_at_50%_30%,rgba(192,132,252,0.28),transparent_55%)]"
          }`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]" />
      </div>

      <header className="relative z-20 border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Heart className="h-4 w-4" aria-hidden />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              Lover&apos;s Code
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
              {isNight ? (
                <Moon className="h-4 w-4" aria-hidden />
              ) : (
                <Sun className="h-4 w-4" aria-hidden />
              )}
              <time
                className="text-sm tabular-nums"
                dateTime={currentTime.toISOString()}
              >
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </time>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,520px)] lg:gap-16 xl:gap-20">
            <div className="order-2 flex flex-col gap-8 lg:order-1">
              <div className="space-y-5 animate-fade-in">
                <Badge
                  variant="secondary"
                  className="w-fit gap-1.5 border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Connection, reimagined
                </Badge>
                <h1 className="font-playfair text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
                  A calmer place for{" "}
                  <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                    real conversation
                  </span>
                  .
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Solo reflection, shared rooms, and an AI companion—each tuned
                  for presence over noise. Pick a path and start in seconds.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-in">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-base font-semibold shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-violet-500/35"
                >
                  {user ? "Continue your journey" : "Get started"}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-border/80 bg-background/50 backdrop-blur-sm"
                  onClick={() => handleFeatureClick("multiplayer")}
                >
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  Browse multiplayer
                </Button>
              </div>

              {user ? (
                <p className="text-sm text-muted-foreground animate-fade-in">
                  Welcome back,{" "}
                  <span className="font-medium text-foreground">
                    {user.username}
                  </span>
                  . Your hub is one tap away.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                {features.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <Card
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFeatureClick(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleFeatureClick(f.id);
                        }
                      }}
                      className={`group cursor-pointer border-border/60 bg-card/40 backdrop-blur-sm transition hover:border-primary/30 hover:shadow-md animate-fade-in`}
                      style={{ animationDelay: `${0.1 * (i + 1)}s` }}
                    >
                      <CardHeader className="pb-2">
                        <div
                          className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-md`}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <CardTitle className="font-display text-lg">
                          {f.title}
                        </CardTitle>
                        <CardDescription className="text-sm leading-snug">
                          {f.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                          Open
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <figure className="rounded-2xl border border-border/50 bg-muted/20 p-5 backdrop-blur-sm animate-fade-in">
                <blockquote className="text-center font-playfair text-base italic leading-relaxed text-foreground/90 sm:text-lg">
                  &ldquo;Every heart has its own melody—here, the room is wide
                  enough to hear it.&rdquo;
                </blockquote>
                <figcaption className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  Built for warmth, not hustle
                </figcaption>
              </figure>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative mx-auto max-w-[min(100%,520px)] animate-fade-in-right">
                <div
                  className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent blur-2xl"
                  aria-hidden
                />
                <div className="relative rounded-[1.75rem] border border-white/10 bg-zinc-950 p-3 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
                  <RotatingEarth
                    width={640}
                    height={640}
                    className="[&_.text-muted-foreground]:text-zinc-400"
                  />
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Live globe · Natural Earth land data · Drag &amp; zoom
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
