import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Surfaces React render errors instead of a blank root (common after bad HMR or bad state). */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.stack ?? this.state.error.message
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 720 }}>
          <h1 style={{ color: '#b00', fontSize: 18 }}>Elfenstein failed to render</h1>
          <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: 'pre-wrap', overflow: 'auto' }}>{msg}</pre>
          <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
            Dev: if the console mentioned Vite and <code>export named &apos;t&apos;</code>, stop the server, run{' '}
            <code>npm run dev:clean</code> or <code>npm run dev:force</code>, then open the URL Vite prints (port may
            differ if 5173 was busy).
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
