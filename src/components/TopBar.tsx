import HelpDialog from "./HelpDialog";
import ThemeToggle from "./ThemeToggle";

// Sticky header across the main content area: help + theme controls, right-aligned.
export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-end gap-2 border-b bg-bg/80 px-6 py-2.5 backdrop-blur md:px-10">
      <HelpDialog />
      <ThemeToggle />
    </header>
  );
}
