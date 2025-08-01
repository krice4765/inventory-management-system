// src/pages/about.tsx
import type { NextPage } from 'next'

const AboutPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">About Us</h1>
        <p className="text-lg text-gray-600">Welcome to our application!</p>
      </div>
    </div>
  )
}

export default AboutPage