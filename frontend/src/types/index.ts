export interface Field {
  name: string
  label: string
  field_type: string
  required: boolean
  default_value: string
}

export interface Template {
  id: number
  name: string
  description: string
  category: string
  content_html: string
  fields_json: Field[]
  created_at: string
  updated_at: string
}

export interface TemplateVersion {
  id: number
  template_id: number
  version_number: number
  content_html: string
  fields_json: Field[]
  created_at: string
}

export type ExportFormat = 'docx' | 'pdf'

export interface Document {
  id: number
  name: string
  template_id: number | null
  content_html: string
  created_at: string
  updated_at: string
}
