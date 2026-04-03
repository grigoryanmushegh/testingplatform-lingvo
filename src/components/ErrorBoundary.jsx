import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:"100vh",background:"#0F172A",display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:20,padding:24,fontFamily:"Montserrat,sans-serif"}}>
          <div style={{fontSize:48}}>⚠️</div>
          <div style={{color:"#fff",fontSize:20,fontWeight:800,textAlign:"center"}}>Something went wrong</div>
          <div style={{color:"rgba(255,255,255,.5)",fontSize:13,textAlign:"center",maxWidth:400,lineHeight:1.6}}>
            An unexpected error occurred. Your answers have been auto-saved.<br/>Please refresh the page to continue.
          </div>
          <button onClick={()=>window.location.reload()} style={{
            background:"#11CD87",color:"#064E3B",border:"none",borderRadius:12,
            padding:"12px 32px",fontSize:14,fontWeight:800,cursor:"pointer"
          }}>
            Refresh Page
          </button>
          {process.env.NODE_ENV === "development" && (
            <details style={{color:"rgba(255,255,255,.3)",fontSize:11,maxWidth:600,wordBreak:"break-all"}}>
              <summary style={{cursor:"pointer"}}>Error details</summary>
              <pre style={{marginTop:8}}>{this.state.error?.toString()}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
