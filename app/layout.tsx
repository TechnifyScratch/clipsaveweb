import type { Metadata } from 'next';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import './globals.css';
export const metadata:Metadata={title:'ClipSave — Videos, ready for class.',description:'A small, local YouTube to MP4 utility for your class submissions.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('clipsave-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()`}} /></head><body>{children}</body></html>;}
