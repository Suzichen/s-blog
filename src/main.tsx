import React from 'react'
import ReactDOM from 'react-dom/client'
import { SBlogApp } from '@s-blog/core'
import { siteConfig } from './config'
import { albumConfig } from './album.config'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SBlogApp siteConfig={siteConfig} albumConfig={albumConfig} />
  </React.StrictMode>,
)
