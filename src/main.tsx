import React from 'react'
import ReactDOM from 'react-dom/client'
import { SpageApp } from '@s-blog/core'
import '@s-blog/core/style.css'
import { siteConfig } from './config'
import { albumConfig } from './album.config'
import { memoConfig } from './memo.config'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SpageApp siteConfig={siteConfig} albumConfig={albumConfig} memoConfig={memoConfig} />
  </React.StrictMode>,
)
