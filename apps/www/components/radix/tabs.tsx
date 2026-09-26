import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/ui/tabs";
import type * as React from "react";

function TabsContents({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

type TabsContentsProps = React.ComponentProps<"div">;
type TabsContentProps = React.ComponentProps<typeof TabsContent>;
type TabsListProps = React.ComponentProps<typeof TabsList>;
type TabsProps = React.ComponentProps<typeof Tabs>;
type TabsTriggerProps = React.ComponentProps<typeof TabsTrigger>;

export {
  Tabs,
  TabsContent,
  type TabsContentProps,
  TabsContents,
  type TabsContentsProps,
  TabsList,
  type TabsListProps,
  type TabsProps,
  TabsTrigger,
  type TabsTriggerProps,
};
