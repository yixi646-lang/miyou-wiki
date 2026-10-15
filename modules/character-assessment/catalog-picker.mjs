// 独立入口供维护与测试使用；运行界面从既有浮层模块读取，避免旧服务资源白名单阻断加载。
export {filterButtonsHTML,refreshFilterButtons,catalogChoiceHTML,catalogCandidates,filterCatalogCandidates,openCatalogPicker} from './analysis-dialog.mjs';
