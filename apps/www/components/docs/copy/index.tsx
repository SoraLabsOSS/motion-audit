"use client";

import { Button } from "@workspace/ui/components/ui/button";
import { useControlledState } from "@workspace/ui/hooks/use-controlled-state";
import { cn } from "@workspace/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, MouseEvent } from "react";
import { useCallback } from "react";

import { CopyIcon } from "@/components/icons/copy";

type ButtonProps = ComponentProps<typeof Button>;

type CopyButtonProps = Omit<ButtonProps, "children"> & {
  content?: string;
  copied?: boolean;
  isCopied?: boolean;
  onCopiedChange?: (copied: boolean, content?: string) => void;
  onCopyChange?: (isCopied: boolean) => void;
  onCopy?: (content?: string) => void;
  delay?: number;
};

const CopyButton = ({
  className,
  content,
  copied,
  isCopied: isCopiedProp,
  onCopiedChange,
  onCopyChange,
  onCopy,
  onClick,
  variant = "ghost",
  size = "icon-sm",
  delay = 3000,
  ...props
}: CopyButtonProps) => {
  const [isCopied, setIsCopied] = useControlledState({
    defaultValue: false,
    onChange: (val) => {
      onCopiedChange?.(val, content);
      onCopyChange?.(val);
    },
    value: copied ?? isCopiedProp,
  });
  const prefersReducedMotion = useReducedMotion();

  const handleCopy = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (isCopied || !content) {
        return;
      }

      try {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        onCopiedChange?.(true, content);
        onCopy?.(content);
        setTimeout(() => {
          setIsCopied(false);
          onCopiedChange?.(false);
        }, delay);
      } catch (error) {
        console.error("Error copying command", error);
      }
    },
    [onClick, isCopied, content, setIsCopied, onCopiedChange, onCopy, delay]
  );

  return (
    <Button
      asChild
      className={cn("!size-7 rounded-[min(var(--radius-md),12px)]", className)}
      data-slot="copy-button"
      size={size}
      variant={variant}
      {...props}
    >
      <motion.button
        onClick={handleCopy}
        transition={{
          damping: 30,
          mass: 0.5,
          stiffness: 500,
          type: "spring",
        }}
        type="button"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      >
        <CopyIcon animate={isCopied} size={16} />
      </motion.button>
    </Button>
  );
};

export { CopyButton, type CopyButtonProps };
export { CopyIcon } from "@/components/icons/copy";
