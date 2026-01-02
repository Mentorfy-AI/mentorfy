/**
 * Layout for forms route group
 * No auth required - these are public/experimental routes
 */
export default function FormsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
