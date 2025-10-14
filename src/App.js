/**
 * Entry Wrapper · 入口包装
 * -----------------------------------------------------------------------------
 * This component now only mounts the feature-rich `AppContainer`, keeping the
 * top-level file lightweight per architecture guidelines.
 * 依照最新要求，`App.js` 只承担入口职责，真正的业务逻辑已迁移至
 * `src/app/containers/AppContainer.js`。
 */
import React from 'react';
import { AppContainer } from './app/containers/AppContainer';

export default function App() {
        return <AppContainer />;
}
