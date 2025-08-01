import type { NextPage } from 'next'
import Head from 'next/head'

const HomePage: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Gemini CLI 活用ガイド</title>
        <meta name="description" content="Gemini CLIの実装手順と市場価値を高める活用例" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-blue-600 text-white p-6 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-4xl font-extrabold text-center">Gemini CLI 活用ガイド</h1>
          <p className="text-xl text-center mt-2">AIを活用して開発効率と市場価値を最大化する</p>
        </div>
      </header>

      <main className="container mx-auto p-6 mt-8">
        <section className="bg-white p-8 rounded-lg shadow-lg mb-8">
          <h2 className="text-3xl font-bold text-blue-700 mb-4">Gemini CLIとは？</h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Gemini CLIは、Googleの最先端AIモデルであるGeminiをコマンドラインから直接利用するための強力なツールです。
            コード生成、デバッグ、ドキュメント作成、テストコードの自動生成など、開発プロセスのあらゆる側面をAIで強化し、
            エンジニアの生産性を飛躍的に向上させます。
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mt-4">
            このガイドでは、Gemini CLIの導入から、あなたの市場価値を劇的に高める実践的な活用例までを詳しく解説します。
          </p>
        </section>

        <section className="bg-white p-8 rounded-lg shadow-lg mb-8">
          <h2 className="text-3xl font-bold text-blue-700 mb-4">実装手順</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            Gemini CLIをあなたの開発環境に導入する手順は非常にシンプルです。
          </p>
          <h3 className="text-2xl font-semibold text-blue-600 mb-3">1. 必要なツールのインストール</h3>
          <ul className="list-disc list-inside text-lg text-gray-700 ml-4 mb-4">
            <li>Node.js (npmまたはyarn)</li>
            <li>Python (pip)</li>
            <li>Google Cloud SDK (gcloud CLI)</li>
          </ul>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3">2. Gemini CLIのインストール</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            npmまたはyarnを使って、Gemini CLIをグローバルにインストールします。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>npm install -g @google/gemini-cli</code></pre>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto mt-2"><code>yarn global add @google/gemini-cli</code></pre>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3 mt-6">3. 認証設定</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            Gemini APIを利用するために、Google Cloud Platformで認証情報を設定します。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>gcloud auth application-default login</code></pre>
          <p className="text-lg text-gray-700 leading-relaxed mt-2">
            または、APIキーを環境変数に設定します。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>export GEMINI_API_KEY="YOUR_API_KEY"</code></pre>
        </section>

        <section className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold text-blue-700 mb-4">市場価値を高める活用例</h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            Gemini CLIは単なるツールではありません。あなたの開発スキルと市場価値を飛躍的に向上させるための戦略的パートナーです。
          </p>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3">1. コードのリファクタリングと品質向上</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            既存のコードベースをGemini CLIに渡し、よりクリーンで効率的なコードへのリファクタリング案を提案させます。
            可読性の向上、パフォーマンス最適化、バグの潜在的な原因特定などに活用できます。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>gemini refactor src/utils/legacy_code.js</code></pre>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3 mt-6">2. テストコードの自動生成</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            特定の関数やモジュールに対するテストケースを自動生成させ、テストカバレッジを向上させます。
            これにより、開発者はより重要なロジックの実装に集中できます。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>gemini generate-test src/components/Button.tsx</code></pre>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3 mt-6">3. ドキュメントの自動生成と更新</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            APIドキュメント、READMEファイル、コードコメントなどを自動生成・更新させます。
            これにより、プロジェクトのメンテナンス性が向上し、新規参入者のオンボーディングがスムーズになります。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>gemini document lib/api_client.py</code></pre>

          <h3 className="text-2xl font-semibold text-blue-600 mb-3 mt-6">4. 新規機能のプロトタイピングとアイデア出し</h3>
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            漠然としたアイデアから、Gemini CLIに初期のコードスニペットやアーキテクチャの提案をさせます。
            これにより、開発の初期段階での試行錯誤のコストを大幅に削減できます。
          </p>
          <pre className="bg-gray-800 text-white p-4 rounded-md text-sm overflow-x-auto"><code>gemini prototype "ユーザー認証機能を備えたシンプルなWebアプリケーションのバックエンド"</code></pre>
        </section>
      </main>

      <footer className="bg-gray-800 text-white p-6 mt-8 text-center">
        <p>&copy; 2025 Gemini CLI Guide. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default HomePage