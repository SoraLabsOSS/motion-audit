"use client";

import { Button } from "@workspace/ui/components/ui/button";
import { useControlledState } from "@workspace/ui/hooks/use-controlled-state";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import type * as React from "react";
import { useCallback } from "react";

type ButtonProps = React.ComponentProps<typeof Button>;

type CopyButtonProps = Omit<ButtonProps, "children"> & {
  content?: string;
  copied?: boolean;
  isCopied?: boolean;
  onCopiedChange?: (copied: boolean, content?: string) => void;
  onCopyChange?: (isCopied: boolean) => void;
  onCopy?: (content?: string) => void;
  delay?: number;
};

function CopyButton({
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
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useControlledState({
    defaultValue: false,
    onChange: (val) => {
      onCopiedChange?.(val, content);
      onCopyChange?.(val);
    },
    value: copied ?? isCopiedProp,
  });

  const handleCopy = useCallback(
    (e: Parameters<NonNullable<ButtonProps["onClick"]>>[0]) => {
      onClick?.(e);
      if (isCopied) {
        return;
      }
      if (content) {
        navigator.clipboard
          .writeText(content)
          .then(() => {
            setIsCopied(true);
            onCopiedChange?.(true, content);
            onCopy?.(content);
            setTimeout(() => {
              setIsCopied(false);
              onCopiedChange?.(false);
            }, delay);
          })
          .catch((error) => {
            console.error("Error copying command", error);
          });
      }
    },
    [onClick, isCopied, content, setIsCopied, onCopiedChange, onCopy, delay]
  );

  return (
    <Button
      className={cn(className)}
      data-slot="copy-button"
      onClick={handleCopy}
      size={size}
      variant={variant}
      {...props}
    >
      {isCopied ? <Check size={16} /> : <Copy size={16} />}
    </Button>
  );
}

export { CopyButton, type CopyButtonProps };
