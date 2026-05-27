interface CreateSubjectPayload {
  name: string;
  code: string;
}

interface SubjectApiEntry {
  id: string;
  name: string;
  code: string | null;
}

type SubjectCatalogOption = {
  id: string;
  label: string;
  value: string;
};

type SubjectCatalogItem = {
  id: string;
  name: string;
  value: string;
};

type SubjectCatalogState = {
  subjects: SubjectCatalogItem[];
};
