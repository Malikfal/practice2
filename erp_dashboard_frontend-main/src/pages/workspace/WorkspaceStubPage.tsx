export default function WorkspaceStubPage({ title }: { title: string }) {
  return (
    <section className='flex h-full min-h-0 items-center justify-center rounded-xl border border-[#e3e9f3] bg-white p-6 text-center'>
      <div>
        <h1 className='text-[22px] leading-tight font-semibold text-[#1f3565]'>
          {title}
        </h1>
        <p className='mt-2 text-sm text-[#7e8fb4]'>Раздел находится в разработке.</p>
      </div>
    </section>
  );
}
