import React from 'react';
import { Bot } from 'lucide-react';

interface WLOResourceListProps {
  resources: any[];
  orientation?: 'horizontal' | 'vertical';
}

export default function WLOResourceList({ resources, orientation = 'vertical' }: WLOResourceListProps) {
  if (!resources.length) return null;

  return (
    <div className={`grid gap-4 ${
      orientation === 'vertical' 
        ? 'grid-cols-1'
        : 'grid-cols-1 md:grid-cols-3'
    } max-h-[600px] overflow-y-auto pr-2`}>
      {resources.map((resource) => (
        <div key={resource.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition">
          {/* Preview Image */}
          {(resource.preview?.url || resource.preview_url) ? (
            <img
              src={resource.preview?.url || resource.preview_url}
              alt={resource.name || resource.properties?.['cclom:title']?.[0] || 'Resource preview'}
              className="w-full h-32 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-32 bg-indigo-50 flex items-center justify-center">
              <Bot className="h-12 w-12 text-indigo-200" />
            </div>
          )}
          
          {/* Content */}
          <div className="p-4">
            {/* Title with Link */}
            <h4 className="font-medium text-gray-900 mb-2">
              {(resource.properties?.['ccm:wwwurl']?.[0] || resource.url) ? (
                <a 
                  href={resource.properties?.['ccm:wwwurl']?.[0] || resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 hover:underline"
                >
                  {resource.name || resource.properties?.['cclom:title']?.[0] || 'Untitled'}
                </a>
              ) : (
                resource.name || resource.properties?.['cclom:title']?.[0] || 'Untitled'
              )}
            </h4>
            
            {/* Description */}
            {(resource.properties?.['cclom:general_description']?.[0] || resource.description) && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {resource.properties?.['cclom:general_description']?.[0] || resource.description}
              </p>
            )}
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {/* Subject Tag */}
              {(resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0] || resource.subject) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0] || resource.subject}
                </span>
              )}
              
              {/* Education Level Tags */}
              {(resource.properties?.['ccm:educationalcontext_DISPLAYNAME'] || resource.education_level)?.map((level: string, idx: number) => (
                <span 
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                >
                  {level}
                </span>
              ))}
              
              {/* Resource Type Tag */}
              {(resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0] || resource.resource_type) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0] || resource.resource_type}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}