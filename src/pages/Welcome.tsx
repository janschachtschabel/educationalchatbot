import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, BookOpen, Users, Sparkles, Shield, Rocket, GraduationCap } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';
import { useAuthStore } from '../store/authStore';

export default function Welcome() {
  const { t } = useLanguageStore();
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <div className="text-center mb-16 max-w-4xl">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Bot className="h-20 w-20 text-indigo-600" />
            <div className="absolute -right-2 -bottom-2 bg-indigo-100 rounded-full p-2">
              <Sparkles className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          {t.welcome.title}
        </h1>
        <p className="text-xl text-gray-600">
          {t.welcome.subtitle}
        </p>
      </div>

      {/* Main Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full mb-16">
        {/* For Teachers */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white rounded-full p-3">
                <Users className="h-8 w-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-white">{t.welcome.forTeachers}</h2>
            </div>
            <p className="text-indigo-100 text-lg">
              {t.welcome.forTeachersDesc}
            </p>
          </div>
          <div className="p-6">
            <Link
              to="/dashboard"
              className="block w-full bg-indigo-600 text-white text-center px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-300 font-medium"
            >
              {t.nav.teachers}
            </Link>
          </div>
        </div>

        {/* For Students */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white rounded-full p-3">
                <GraduationCap className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-white">{t.nav.gallery}</h2>
            </div>
            <p className="text-emerald-100 text-lg">
              {t.welcome.forTeachersDesc}
            </p>
          </div>
          <div className="p-6">
            <Link
              to="/gallery"
              className="block w-full bg-emerald-600 text-white text-center px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors duration-300 font-medium"
            >
              {t.nav.gallery}
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-5xl w-full mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature
            icon={<Rocket className="h-6 w-6" />}
            title={t.welcome.features.customChatbots}
            description={t.welcome.features.customChatbotsDesc}
          />
          <Feature
            icon={<Sparkles className="h-6 w-6" />}
            title={t.welcome.features.smartTools}
            description={t.welcome.features.smartToolsDesc}
          />
          <Feature
            icon={<BookOpen className="h-6 w-6" />}
            title={t.welcome.features.resourceIntegration}
            description={t.welcome.features.resourceIntegrationDesc}
          />
        </div>
      </div>

      {/* Admin Panel Link - Only show if user is admin */}
      {user?.is_admin && (
        <div className="mt-4 text-center">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
          >
            <Shield className="h-4 w-4" />
            {t.nav.admin}
          </Link>
        </div>
      )}
    </div>
  );
}

function Feature({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6 rounded-xl bg-gray-50">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}