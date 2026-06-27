"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CHEPUS = [
  "/images/chepu/chepu_on_the_floor.png",
  "/images/chepu/chepu_says_hi.png",
  "/images/chepu/chepu_says_sup.png",
  "/images/chepu/empty_page_chepu.png",
];

export default function NotFoundPage() {
  const pathname = usePathname();
  const [chepuImage, setChepuImage] = useState<string | null>(null);

  useEffect(() => {
    setChepuImage(CHEPUS[Math.floor(Math.random() * CHEPUS.length)]);
  }, []);

  return (
    <main className="min-h-screen w-full bg-gray-100 px-4 text-foreground transition-colors duration-300 dark:bg-slate-900 midnight:bg-black">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center py-10">
        <Card className="w-full border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800 midnight:border-gray-800 midnight:bg-[#0a0a0a]">
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">AmazeCC Routing</p>
            <CardTitle className="text-2xl tracking-tight md:text-3xl">Page not found</CardTitle>
            <CardDescription className="text-sm md:text-base">
              This route does not exist or may have been removed.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {chepuImage && (
              <div className="flex justify-center mb-6">
                <Image
                  src={chepuImage}
                  alt="Random Chepu"
                  width={200}
                  height={200}
                  className="opacity-90 object-contain drop-shadow-md"
                  priority
                />
              </div>
            )}
            <div className="rounded-lg border border-border bg-background/60 p-4 text-sm">
              <p>
                <span className="font-semibold">Requested path:</span> {pathname || "unknown"}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/">Go to dashboard</Link>
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                Go back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
