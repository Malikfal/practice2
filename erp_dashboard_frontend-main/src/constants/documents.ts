export type LegalDocument = {
  id: string;
  title: string;
  is_public: boolean;
  download_url: string;
};

/**
 * Для того что бы привязать работу с документами с суперадминкой
 * хранение и логика были вынесены на backend.
 * Документы хранятся в storage/app/private/docs
 * А управление документами теперь производится через админку
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);

export async function fetchDocuments(isAuthenticated: boolean): Promise<LegalDocument[]> {
  try {
    const endpoint = isAuthenticated ? '/workspace/documents' : '/public/documents';

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Ошибка сервера при загрузке документов:', response.status);
      return [];
    }

    const json = (await response.json()) as { data: LegalDocument[] };
    return json.data;
  } catch (error) {
    console.error('Ошибка сети при загрузке документов:', error);
    return [];
  }
}
