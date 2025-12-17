import StageTabs from '@/components/StageTabs';

export default function StagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StageTabs />
      {children}
    </>
  );
}
