import axios from 'axios'
import type { Template, TemplateVersion, Field, ExportFormat, Document } from '../types'

const api = axios.create({ baseURL: '/api' })

export const templatesApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get<Template[]>('/templates/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Template>(`/templates/${id}`).then(r => r.data),

  create: (data: Partial<Template>) =>
    api.post<Template>('/templates/', data).then(r => r.data),

  update: (id: number, data: Partial<Template>) =>
    api.put<Template>(`/templates/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/templates/${id}`),

  duplicate: (id: number) =>
    api.post<Template>(`/templates/${id}/duplicate`).then(r => r.data),

  getFields: (id: number) =>
    api.get<Field[]>(`/templates/${id}/fields`).then(r => r.data),

  getVersions: (id: number) =>
    api.get<TemplateVersion[]>(`/templates/${id}/versions`).then(r => r.data),

  restoreVersion: (templateId: number, versionId: number) =>
    api.post<Template>(`/templates/${templateId}/restore/${versionId}`).then(r => r.data),

  importDocx: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ template_id: number; name: string; fields_detected: Field[]; message: string }>(
      '/templates/import-docx', form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },

  export: async (id: number, format: ExportFormat, fieldValues: Record<string, string>) => {
    const r = await api.post(
      `/templates/${id}/export`,
      { format, field_values: fieldValues },
      { responseType: 'blob' }
    )
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `template.${format}`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const categoriesApi = {
  list: () => api.get<string[]>('/categories').then(r => r.data),
}

export const documentsApi = {
  list: () =>
    api.get<Document[]>('/documents/').then(r => r.data),

  get: (id: number) =>
    api.get<Document>(`/documents/${id}`).then(r => r.data),

  create: (data: { name: string; template_id?: number; content_html?: string }) =>
    api.post<Document>('/documents/', data).then(r => r.data),

  update: (id: number, data: { name?: string; content_html?: string }) =>
    api.put<Document>(`/documents/${id}`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/documents/${id}`),

  copy: (id: number) =>
    api.post<Document>(`/documents/${id}/copy`).then(r => r.data),

  export: async (id: number, format: ExportFormat) => {
    const r = await api.post(`/documents/${id}/export`, { format, field_values: {} }, { responseType: 'blob' })
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a'); a.href = url; a.download = `document.${format}`; a.click()
    URL.revokeObjectURL(url)
  },
}
