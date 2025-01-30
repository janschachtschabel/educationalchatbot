import React, { useState } from 'react';
import { User, Link, Building, Book, GraduationCap, Globe, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguageStore } from '../lib/useTranslations';
import { TeacherProfile } from '../lib/types';
import { BILDUNGSSTUFEN, FAECHER } from '../lib/constants';
import MultiSelect from './MultiSelect';

interface TeacherProfileFormProps {
  profile: TeacherProfile;
  onSave: (profile: TeacherProfile) => void;
  onClose: () => void;
}

export default function TeacherProfileForm({ profile, onSave, onClose }: TeacherProfileFormProps) {
  const { t } = useLanguageStore();
  const [formData, setFormData] = useState<TeacherProfile>({
    ...profile,
    author_nickname: profile.author_nickname || profile.full_name || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          author_nickname: formData.author_nickname || formData.full_name || null,
          bio: formData.bio || null,
          website: formData.website || null,
          institution: formData.institution || null,
          subjects: formData.subjects || [],
          education_levels: formData.education_levels || [],
          profile_image: formData.profile_image || null,
          social_links: {
            twitter: formData.social_links?.twitter || null,
            linkedin: formData.social_links?.linkedin || null,
            github: formData.social_links?.github || null,
          },
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Also update author_nickname in existing chatbots
      const { error: chatbotError } = await supabase
        .from('chatbot_templates')
        .update({
          author_nickname: formData.author_nickname || formData.full_name || null
        })
        .eq('creator_id', profile.id);

      if (chatbotError) throw chatbotError;

      onSave(formData);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {t.profile.editProfile}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="inline h-4 w-4 mr-2" />
              {t.profile.fullName}
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <AtSign className="inline h-4 w-4 mr-2" />
              {t.profile.authorNickname}
            </label>
            <input
              type="text"
              value={formData.author_nickname}
              onChange={(e) => setFormData({ ...formData, author_nickname: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              placeholder={t.profile.authorNicknamePlaceholder}
            />
            <p className="mt-1 text-sm text-gray-500">
              {t.profile.authorNicknameHelp}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.profile.bio}
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building className="inline h-4 w-4 mr-2" />
                {t.profile.institution}
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Globe className="inline h-4 w-4 mr-2" />
                {t.profile.website}
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Book className="inline h-4 w-4 mr-2" />
              {t.profile.subjects}
            </label>
            <MultiSelect
              options={FAECHER}
              selected={formData.subjects || []}
              onChange={(selected) => setFormData({ ...formData, subjects: selected })}
              placeholder="Fächer auswählen..."
              searchPlaceholder="Nach Fächern suchen..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <GraduationCap className="inline h-4 w-4 mr-2" />
              {t.profile.educationLevels}
            </label>
            <MultiSelect
              options={BILDUNGSSTUFEN}
              selected={formData.education_levels || []}
              onChange={(selected) => setFormData({ ...formData, education_levels: selected })}
              placeholder="Bildungsstufen auswählen..."
              searchPlaceholder="Nach Bildungsstufen suchen..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Link className="inline h-4 w-4 mr-2" />
              {t.profile.socialLinks}
            </label>
            <div className="space-y-2">
              <input
                type="url"
                placeholder="Twitter URL"
                value={formData.social_links?.twitter}
                onChange={(e) => setFormData({
                  ...formData,
                  social_links: {
                    ...formData.social_links,
                    twitter: e.target.value
                  }
                })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
              <input
                type="url"
                placeholder="LinkedIn URL"
                value={formData.social_links?.linkedin}
                onChange={(e) => setFormData({
                  ...formData,
                  social_links: {
                    ...formData.social_links,
                    linkedin: e.target.value
                  }
                })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
              <input
                type="url"
                placeholder="GitHub URL"
                value={formData.social_links?.github}
                onChange={(e) => setFormData({
                  ...formData,
                  social_links: {
                    ...formData.social_links,
                    github: e.target.value
                  }
                })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}