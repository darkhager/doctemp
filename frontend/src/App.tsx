import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import Layout from './components/Layout/Layout'
import HomePage from './components/HomePage/HomePage'
import TemplateLibrary from './components/TemplateLibrary/TemplateLibrary'
import EditorPage from './components/Editor/EditorPage'
import FillFormPage from './components/FillForm/FillFormPage'
import DocumentList from './components/DocumentList/DocumentList'
import DocumentEditorPage from './components/DocumentEditor/DocumentEditorPage'

export default function App() {
  return (
    <ToastProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/templates" element={<TemplateLibrary />} />
        <Route path="/templates/new" element={<EditorPage />} />
        <Route path="/templates/:id/edit" element={<EditorPage />} />
        <Route path="/templates/:id/fill" element={<FillFormPage />} />
        <Route path="/documents" element={<DocumentList />} />
        <Route path="/documents/new" element={<DocumentEditorPage />} />
        <Route path="/documents/:id/edit" element={<DocumentEditorPage />} />
      </Routes>
    </Layout>
    </ToastProvider>
  )
}
