'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Editor híbrido WYSIWYG ↔ HTML.
 *
 * - Modo "Visual": contentEditable com toolbar (negrito, itálico, listas,
 *   alinhamento, link, imagem por URL). Usa document.execCommand — sim,
 *   está marcado como legacy, mas ainda é o caminho universal pra editores
 *   leves sem dependência externa. Quando o suporte for removido em algum
 *   navegador, migramos pra Tiptap; até lá, mantém zero dep.
 *
 * - Modo "HTML": textarea com o código bruto. Cole aqui um HTML completo
 *   de e-mail marketing (com <html>, <body>, inline styles, tabelas) e
 *   volte ao Visual pra revisar.
 *
 * O componente sempre emite o HTML cru via `onChange` — quem usa não
 * precisa saber em qual modo o editor está. Trocas de modo sincronizam
 * automaticamente o conteúdo.
 */
interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  /** Inicia em qual modo. Default: 'visual'. */
  initialMode?: 'visual' | 'html'
}

type Mode = 'visual' | 'html'

export default function HtmlEditor({
  value,
  onChange,
  placeholder,
  minHeight = 320,
  initialMode = 'visual',
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const editorRef = useRef<HTMLDivElement | null>(null)

  // Sincroniza o conteúdo do contentEditable com `value` SEM disparar
  // re-render durante a digitação (que destruiria o caret).
  useEffect(() => {
    if (mode !== 'visual') return
    const el = editorRef.current
    if (!el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [mode, value])

  const exec = useCallback((command: string, arg?: string) => {
    // execCommand está deprecated mas funciona em todos navegadores atuais.
    // Não usamos focus() antes — o handler de mousedown na toolbar previne
    // o blur do editor (preventDefault), mantendo a seleção viva.
    document.execCommand(command, false, arg)
    const el = editorRef.current
    if (el) onChange(el.innerHTML)
  }, [onChange])

  const handleLink = useCallback(() => {
    const url = window.prompt('URL do link:', 'https://')
    if (url) exec('createLink', url)
  }, [exec])

  const handleImage = useCallback(() => {
    const url = window.prompt('URL da imagem (cole o link público):', 'https://')
    if (url) exec('insertImage', url)
  }, [exec])

  const handleClear = useCallback(() => {
    if (window.confirm('Limpar todo o conteúdo do editor?')) {
      onChange('')
    }
  }, [onChange])

  const switchTo = (next: Mode) => {
    if (next === mode) return
    // Antes de trocar, garantir que o valor mais recente do modo ativo
    // já chegou ao state (no Visual, contentEditable só dispara onInput
    // após algumas interações — fazemos um sync manual).
    if (mode === 'visual' && editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
    setMode(next)
  }

  return (
    <div style={{ border: '1px solid #D8DCE8', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {mode === 'visual' && (
            <>
              <ToolButton onClick={() => exec('bold')} title="Negrito (Ctrl+B)"><strong>N</strong></ToolButton>
              <ToolButton onClick={() => exec('italic')} title="Itálico (Ctrl+I)"><em>I</em></ToolButton>
              <ToolButton onClick={() => exec('underline')} title="Sublinhado (Ctrl+U)"><u>S</u></ToolButton>
              <Separator />
              <ToolButton onClick={() => exec('insertUnorderedList')} title="Lista">• Lista</ToolButton>
              <ToolButton onClick={() => exec('insertOrderedList')} title="Lista numerada">1. Lista</ToolButton>
              <Separator />
              <ToolButton onClick={() => exec('justifyLeft')} title="Alinhar à esquerda">⯇</ToolButton>
              <ToolButton onClick={() => exec('justifyCenter')} title="Centralizar">≡</ToolButton>
              <ToolButton onClick={() => exec('justifyRight')} title="Alinhar à direita">⯈</ToolButton>
              <Separator />
              <ToolButton onClick={handleLink} title="Inserir link">🔗 Link</ToolButton>
              <ToolButton onClick={handleImage} title="Inserir imagem">🖼 Imagem</ToolButton>
              <Separator />
              <ToolButton onClick={() => exec('removeFormat')} title="Limpar formatação">⌫</ToolButton>
              <ToolButton onClick={handleClear} title="Limpar tudo">Limpar</ToolButton>
            </>
          )}
          {mode === 'html' && (
            <span style={{ fontSize: '13px', color: '#6B7494', padding: '6px 8px' }}>
              Editando o HTML diretamente — cole aqui um e-mail marketing completo, depois clique em <strong>Visual</strong> para visualizar.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #D8DCE8', flexShrink: 0 }}>
          <ModeButton active={mode === 'visual'} onClick={() => switchTo('visual')}>Visual</ModeButton>
          <ModeButton active={mode === 'html'} onClick={() => switchTo('html')}>HTML</ModeButton>
        </div>
      </div>

      {mode === 'visual' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
          // Cole HTML cru: pega text/html do clipboard e injeta como está.
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (html) {
              e.preventDefault()
              document.execCommand('insertHTML', false, html)
              const el = editorRef.current
              if (el) onChange(el.innerHTML)
            }
          }}
          data-placeholder={placeholder || 'Digite ou cole conteúdo aqui...'}
          style={{
            minHeight: `${minHeight}px`,
            padding: '14px 16px',
            outline: 'none',
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#1D2235',
          }}
        />
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '<!-- cole aqui o HTML completo do e-mail -->'}
          spellCheck={false}
          style={{
            display: 'block',
            width: '100%',
            minHeight: `${minHeight}px`,
            padding: '14px 16px',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: 1.5,
            resize: 'vertical',
            color: '#1D2235',
            background: '#FAFCFE',
          }}
        />
      )}

      {/* placeholder do contentEditable via CSS */}
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #A8AFCA;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}

function ToolButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()} // evita perder a seleção
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid transparent',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#1D2235',
        minWidth: '32px',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F0F5FB')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        border: 'none',
        background: active ? '#1D2235' : 'white',
        color: active ? 'white' : '#1D2235',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <span style={{ width: '1px', background: '#E3E9F4', margin: '4px 4px' }} aria-hidden />
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 10px',
  borderBottom: '1px solid #E3E9F4',
  background: '#F9FBFD',
  flexWrap: 'wrap',
}
