import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../api/api';
import {
  ACTIVE_DATA_IMPORT_STATUSES,
  DATA_IMPORT_MAX_FILE_SIZE,
  DATA_IMPORT_TYPES,
} from '../constants/dataImports';
import type { DataImport, DataImportType } from '../types/dataImport';

const ACCEPTED_TOAST_ID = 'data-import-accepted';

type Options = {
  initialType: DataImportType;
  /** Вызывается после приёма файла и на каждом шаге опроса прогресса. */
  onAccepted?: (_dataImport: DataImport) => void;
};

/**
 * Загрузка файла импорта на сервер и опрос прогресса обработки.
 * Общая логика для страницы «Импорт» в настройках и модалки на страницах разделов.
 */
export function useDataImportUpload({ initialType, onAccepted }: Options) {
  const [type, setTypeState] = useState<DataImportType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentImport, setCurrentImport] = useState<DataImport | null>(null);
  // Колбэк в ref, чтобы опрос не перезапускался при каждом рендере родителя.
  const onAcceptedRef = useRef(onAccepted);

  useEffect(() => {
    onAcceptedRef.current = onAccepted;
  }, [onAccepted]);

  const importId = currentImport?.id;
  const isActive = currentImport
    ? ACTIVE_DATA_IMPORT_STATUSES.has(currentImport.status)
    : false;

  useEffect(() => {
    if (!importId || !isActive) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.imports.get(importId);
        setCurrentImport(next);
        onAcceptedRef.current?.(next);
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [importId, isActive]);

  // Тост о приёме файла не переживает форму: при уходе со страницы или закрытии окна он скрывается.
  useEffect(() => () => void toast.dismiss(ACCEPTED_TOAST_ID), []);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileInputKey((value) => value + 1);
  }, []);

  const setType = useCallback(
    (next: DataImportType) => {
      setTypeState(next);
      clearFile();
    },
    [clearFile],
  );

  /** Возвращает форму к выбору файла; тип можно сменить сразу. */
  const reset = useCallback(
    (nextType?: DataImportType) => {
      if (nextType && DATA_IMPORT_TYPES.includes(nextType)) setTypeState(nextType);
      toast.dismiss(ACCEPTED_TOAST_ID);
      setCurrentImport(null);
      clearFile();
    },
    [clearFile],
  );

  const upload = useCallback(async () => {
    if (!file) return;
    if (file.size > DATA_IMPORT_MAX_FILE_SIZE) {
      toast.error('Размер файла не должен превышать 20 МБ.');
      return;
    }
    try {
      setIsUploading(true);
      const result = await api.imports.create(type, file);
      setCurrentImport(result);
      onAcceptedRef.current?.(result);
      // Прогресс виден в карточке импорта, поэтому тост короткий.
      toast.success('Файл загружен.', { id: ACCEPTED_TOAST_ID, duration: 2500 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить файл.');
    } finally {
      setIsUploading(false);
    }
  }, [file, type]);

  return {
    type,
    setType,
    file,
    setFile,
    fileInputKey,
    isUploading,
    currentImport,
    isActive,
    upload,
    reset,
  };
}

export type DataImportUpload = ReturnType<typeof useDataImportUpload>;

/**
 * Типы импорта, доступные пользователю. Сервер отдаёт их в мете списка импортов;
 * пока ответа нет или он без меты, показываем все типы, а права проверит сервер при загрузке.
 */
export function useAllowedImportTypes(enabled = true) {
  const [allowedTypes, setAllowedTypes] = useState<DataImportType[]>(DATA_IMPORT_TYPES);

  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    api.imports
      .getMany(1, 1)
      .then((response) => {
        const types = response.meta.allowed_types;
        if (!isCancelled && types) {
          setAllowedTypes(DATA_IMPORT_TYPES.filter((type) => types.includes(type)));
        }
      })
      .catch(() => undefined);
    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  return allowedTypes;
}
