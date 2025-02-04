import React from 'react';
import { ExternalLink } from 'lucide-react';

// Base URL for WLO previews
const WLO_BASE_URL = 'https://redaktion.openeduhub.net';

interface ResourceCardProps {
  resource: {
    name: string;
    properties?: {
      'cclom:title'?: string[];
      'cclom:general_description'?: string[];
      'ccm:taxonid_DISPLAYNAME'?: string[];
      'ccm:educationalcontext_DISPLAYNAME'?: string[];
      'ccm:wwwurl'?: string[];
      'ccm:oeh_lrt_aggregated_DISPLAYNAME'?: string[];
    };
    preview?: {
      url: string;
    };
  };
}

// Helper function to fix preview URLs
const fixPreviewUrl = (url: string) => {
  if (!url) return null;
  
  // If URL starts with /edu-sharing, prepend the base URL
  if (url.startsWith('/edu-sharing')) {
    return `${WLO_BASE_URL}${url}`;
  }
  
  // If URL contains /api/edu-sharing, replace with correct base
  if (url.includes('/api/edu-sharing')) {
    return url.replace(/.*\/api\/edu-sharing/, `${WLO_BASE_URL}/edu-sharing`);
  }

  // If URL contains the Vercel domain, replace it with the correct base
  if (url.includes('.vercel.app/edu-sharing')) {
    return url.replace(/https?:\/\/[^\/]+\/edu-sharing/, `${WLO_BASE_URL}/edu-sharing`);
  }

  return url;
};

export function ResourceCard({ resource }: ResourceCardProps) {
  const title = resource.properties?.['cclom:title']?.[0] || resource.name;
  const description = resource.properties?.['cclom:general_description']?.[0];
  const subject = resource.properties?.['ccm:taxonid_DISPLAYNAME']?.[0];
  const educationalContext = resource.properties?.['ccm:educationalcontext_DISPLAYNAME'] || [];
  const url = resource.properties?.['ccm:wwwurl']?.[0];
  const resourceType = resource.properties?.['ccm:oeh_lrt_aggregated_DISPLAYNAME']?.[0];

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="h-full flex flex-col">
        {resource.preview?.url && (
          <div className="h-40 mb-2 relative">
            <img
              src={fixPreviewUrl(resource.preview.url)}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover rounded"
              loading="lazy"
            />
          </div>
        )}
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <h4 className="font-medium text-base mb-2">
            {url ? (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {title}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              title
            )}
          </h4>
          
          {description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-1 mt-auto">
            {subject && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {subject}
              </span>
            )}
            {educationalContext.map((context, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
              >
                {context}
              </span>
            ))}
            {resourceType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {resourceType}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}