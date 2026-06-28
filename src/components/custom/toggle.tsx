"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function IconToggle() {
  const { setTheme } = useTheme()

  const transitionTheme = (val: string) => {
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => setTheme(val));
    } else {
      setTheme(val);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => transitionTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => transitionTheme("dark")}>
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DropdownToggle() {
  const { setTheme } = useTheme()

  const transitionTheme = (val: string) => {
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => setTheme(val));
    } else {
      setTheme(val);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="w-full">
        <Button variant="outline" size="icon">
          Toggle theme
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[90vw]
          sm:w-[630px]
          md:w-[770px]">
        <DropdownMenuItem onClick={() => transitionTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => transitionTheme("dark")}>Dark</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
