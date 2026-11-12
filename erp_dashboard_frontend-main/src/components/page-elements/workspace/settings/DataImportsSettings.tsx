import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  DATA_IMPORT_HISTORY_PATH,
  DATA_IMPORT_NEW_PATH,
} from '../../../../constants/dataImports';
import {
  useAllowedImportTypes,
  useDataImportUpload,
} from '../../../../hooks/useDataImportUpload';
import SectionHeader from '../../../ui/SectionHeader';
import DataImportForm from '../imports/DataImportForm';
import DataImportHistory from './DataImportHistory';

type DataImportsTab = 'new' | 'history';

const tabs: Array<{ key: DataImportsTab; label: string; path: string }> = [
  { key: 'new', label: 'Импорт', path: DATA_IMPORT_NEW_PATH },
  { key: 'history', label: 'Статистика', path: DATA_IMPORT_HISTORY_PATH },
];

const tabFromPath = (pathname: string): DataImportsTab =>
  pathname.replace(/\/+$/, '') === DATA_IMPORT_HISTORY_PATH ? 'history' : 'new';

/** Вкладка «Импорт»: новый импорт страницей вместо модалки. */
function DataImportNew() {
  const allowedTypes = useAllowedImportTypes();
  const upload = useDataImportUpload({ initialType: allowedTypes[0] ?? 'FINANCES' });
  const { type, setType, currentImport } = upload;

  // Если текущий тип недоступен пользователю, переключаемся на первый доступный.
  useEffect(() => {
    if (!currentImport && allowedTypes.length && !allowedTypes.includes(type)) {
      setType(allowedTypes[0]);
    }
  }, [allowedTypes, currentImport, setType, type]);

  if (!allowedTypes.length) {
    return (
      <div className='rounded-xl border border-dashed border-[#c9d8f8] p-6 text-center text-sm text-[#7e8fb4]'>
        Нет прав на импорт данных.
      </div>
    );
  }

  return (
    <div className='grid max-w-[1100px] gap-4'>
      <p className='text-sm leading-6 text-[#5f7095]'>
        Выберите, какие данные загрузить, скачайте шаблон, заполните его и загрузите файл.
        Обработка идёт на сервере, результат и ошибки по строкам видны во вкладке
        «Статистика».
      </p>
      <DataImportForm
        upload={upload}
        typeOptions={allowedTypes}
        variant='page'
        onDone={() => upload.reset()}
        doneLabel='Загрузить ещё файл'
      />
    </div>
  );
}

/**
 * Раздел настроек «Импорт»: вкладка нового импорта и вкладка «Статистика» с историей.
 * Адреса: /settings/imports/new и /settings/imports/history, /settings/imports ведёт на первую.
 */
export default function DataImportsSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPath(location.pathname);
  const activePath =
    tabs.find((tab) => tab.key === activeTab)?.path ?? DATA_IMPORT_NEW_PATH;

  useEffect(() => {
    if (location.pathname !== activePath) {
      navigate({ pathname: activePath, search: location.search }, { replace: true });
    }
  }, [activePath, location.pathname, location.search, navigate]);

  return (
    <section className='flex min-h-0 flex-col overflow-visible rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565] lg:h-full lg:overflow-hidden'>
      <SectionHeader
        overline='Настройки'
        title='Импорт'
        description='Первичная загрузка данных компании: финансы, проекты, сотрудники и оплата труда.'
        tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, to: tab.path }))}
        activeTab={activeTab}
      />

      <div className='min-h-0 flex-1 overflow-visible p-2 md:p-5 lg:overflow-auto'>
        {activeTab === 'history' ? <DataImportHistory /> : <DataImportNew />}
      </div>
    </section>
  );
}
