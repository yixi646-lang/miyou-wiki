# 第三方源码与许可

Genshin Optimizer 原神 7.1 开发版，PR #3316，固定源码 0932414ffcd0232e6784ce1c51524360c9313299，MIT。该源码尚未正式发布；正式版基线为 10.38.1。许可保留在 LICENSE.genshin-optimizer.txt。

Wiki 使用公式、数值、角色 / 武器 / 套装机制、solver / solver-tc / upopt 求解与概率代码及简体中文字段描述，源码保存在 source；由 build-core.mjs 构建独立计算模块。上游 JSX 仅作为字段元数据，不运行 React 网页、广告或外部导航。图片使用 Wiki 本地素材。

此前内嵌构建的字体许可作为历史许可保留；新界面使用 Wiki 现有字体。

搜索以该固定提交的剪枝、BNBSplitWorker 和 ComputeWorker 为核心，Wiki 协调全队与装备唯一性，并按现有套装准备规则复算。强化潜力保留上游分布近似口径。上游预计算中的 Function 编译在构建时替换为指令解释执行，算法与节点规则保留，网页不放宽 CSP。
