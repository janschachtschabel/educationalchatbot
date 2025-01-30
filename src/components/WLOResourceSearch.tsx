import React, { useState } from 'react';
import { Search, Check, Plus } from 'lucide-react';
import { useLanguageStore } from '../lib/useTranslations';
import { searchWLO } from '../lib/wloApi';
import { 
  BILDUNGSSTUFE_MAPPING, 
  FACH_MAPPING, 
  INHALTSTYP_MAPPING,
  BILDUNGSSTUFEN,
  FAECHER,
  INHALTSTYPEN
} from '../lib/constants';
import { ResourceCard } from './preview/components/ResourceCard';

interface WLOResourceSearchProps {
  onSelect: (resources: any[]) => void;
  selectedResources: any[];
}

export default function WLOResourceSearch({ onSelect, selectedResources }: WLOResourceSearchProps) {
  const { t } = useLanguageStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchTerm && !subject && !educationLevel && !resourceType) {
      setError('Please enter search criteria');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const properties = [];
      const values = [];

      // Always add search term if present
      if (searchTerm) {
        properties.push('cclom:title');
        values.push(searchTerm);
      }

      // Add subject with URI mapping
      if (subject) {
        properties.push('ccm:taxonid');
        values.push(FACH_MAPPING[subject as keyof typeof FACH_MAPPING]);
      }

      // Add education level with URI mapping
      if (educationLevel) {
        properties.push('ccm:educationalcontext');
        values.push(BILDUNGSSTUFE_MAPPING[educationLevel as keyof typeof BILDUNGSSTUFE_MAPPING]);
      }

      // Add resource type with URI mapping
      if (resourceType) {
        properties.push('ccm:oeh_lrt_aggregated');
        values.push(INHALTSTYP_MAPPING[resourceType as keyof typeof INHALTSTYP_MAPPING]);
      }

      const response = await searchWLO({
        properties,
        values,
        maxItems: 20,
        combineMode: 'AND'
      });

      if (response && response.nodes) {
        const transformedResults = response.nodes.map(node => ({
          id: node.ref.id,
          name: node.properties['cclom:title']?.[0] || 'Untitled',
          properties: node.properties,
          preview: {
            url: node.preview?.url || null
          },
          url: node.properties['ccm:wwwurl']?.[0] || null,
          title: node.properties['cclom:title']?.[0] || 'Untitled',
          description: node.properties['cclom:general_description']?.[0] || '',
          subject: node.properties['ccm:taxonid_DISPLAYNAME']?.[0] || '',
          education_level: node.properties['ccm:educationalcontext_DISPLAYNAME'] || [],
          resource_type: node.properties['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0] || ''
        }));

        setResults(transformedResults);
      }
    } catch (err) {
      console.error('Error searching WLO:', err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (resource: any) => {
    const isSelected = selectedResources.some(r => r.id === resource.id);
    if (isSelected) {
      onSelect(selectedResources.filter(r => r.id !== resource.id));
    } else {
      onSelect([...selectedResources, resource]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Search Bar - Full Width */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t.dashboard.searchWLO}
            className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
          />
        </div>

        {/* Filter Dropdowns - Below Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">{t.gallery.allSubjects}</option>
            {FAECHER.map((fach) => (
              <option key={fach} value={fach}>
                {fach}
              </option>
            ))}
          </select>

          <select
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">{t.gallery.allLevels}</option>
            {BILDUNGSSTUFEN.map((stufe) => (
              <option key={stufe} value={stufe}>
                {stufe}
              </option>
            ))}
          </select>

          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">{t.dashboard.allTypes}</option>
            {INHALTSTYPEN.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Search className="h-5 w-5" />
            {loading ? t.common.loading : t.common.search}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Selected Resources Section */}
      {selectedResources.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Selected Resources ({selectedResources.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedResources.map((resource) => (
              <div
                key={resource.id}
                className="relative cursor-pointer ring-2 ring-indigo-500"
                onClick={() => handleSelect(resource)}
              >
                <ResourceCard resource={resource} />
                <div className="absolute top-2 right-2">
                  <div className="bg-green-500 text-white p-2 rounded-full shadow-md hover:bg-green-600 transition-colors">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((resource) => {
          const isSelected = selectedResources.some(r => r.id === resource.id);
          return (
            <div
              key={resource.id}
              className={`relative cursor-pointer group ${
                isSelected ? 'ring-2 ring-indigo-500' : ''
              }`}
              onClick={() => handleSelect(resource)}
            >
              <ResourceCard resource={resource} />
              <div className="absolute top-2 right-2">
                <div className={`p-2 rounded-full shadow-md transition-colors ${
                  isSelected 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                }`}>
                  {isSelected ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {results.length === 0 && !loading && !error && (searchTerm || subject || educationLevel || resourceType) && (
        <div className="text-center py-8 text-gray-500">
          {t.dashboard.noMaterialsFound}
        </div>
      )}
    </div>
  );
}