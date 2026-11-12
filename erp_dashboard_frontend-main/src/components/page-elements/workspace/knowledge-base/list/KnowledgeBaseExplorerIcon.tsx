type Props = {
  name:
    | 'chevron-right'
    | 'chevron-down'
    | 'folder'
    | 'file'
    | 'more'
    | 'plus'
    | 'users'
    | 'archive';
  className?: string;
};

export default function KnowledgeBaseExplorerIcon({ name, className = 'size-4' }: Props) {
  const paths = {
    'chevron-right': <path d='m9 18 6-6-6-6' />,
    'chevron-down': <path d='m6 9 6 6 6-6' />,
    folder: (
      <>
        <path d='M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z' />
        <path d='M3 9h18' />
      </>
    ),
    file: (
      <>
        <path d='M6 2h9l5 5v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z' />
        <path d='M14 2v6h6' />
        <path d='M9 13h6M9 17h6' />
      </>
    ),
    more: (
      <>
        <circle cx='5' cy='12' r='1.4' />
        <circle cx='12' cy='12' r='1.4' />
        <circle cx='19' cy='12' r='1.4' />
      </>
    ),
    plus: <path d='M12 5v14M5 12h14' />,
    users: (
      <>
        <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </>
    ),
    archive: (
      <>
        <path d='M3 7h18' />
        <path d='M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7' />
        <path d='M8 7V3h8v4' />
        <path d='M10 12h4' />
      </>
    ),
  };

  return (
    <svg
      className={`${className} fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]`}
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      {paths[name]}
    </svg>
  );
}
