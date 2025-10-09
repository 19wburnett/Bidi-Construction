'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Building2, Phone, Mail, Globe } from 'lucide-react';
import logo from '../../public/brand/Bidi Contracting Logo.svg';

export default function BusinessCardPage() {
  // Contact information
  const contactInfo = {
    name: "Bidi Contracting",
    title: "Construction Management & Bidding Platform",
    phone: "+1-385-216-9587", // Replace with actual phone number
    email: "weston@bidicontracting.com", // Replace with actual email
    website: "https://bidicontracting.com",
    image: logo.src,
  };

  // Generate vCard data
  const generateVCard = () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contactInfo.name}
TITLE:${contactInfo.title}
TEL;TYPE=WORK,VOICE:${contactInfo.phone}
EMAIL:${contactInfo.email}
URL:${contactInfo.website}
END:VCARD`;

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bidi-contracting.vcf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white relative flex items-center justify-center">
      {/* Professional Construction Background Pattern */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container max-w-md mx-auto px-4 py-8">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <img src={logo.src} alt="Bidi Contracting" className="h-24 w-24 md:h-32 md:w-32" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange rounded-full animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-2 tracking-tight font-bidi">
            BIDI
          </h1>
          <p className="text-gray-600 text-sm md:text-base font-medium">
            Streamline Your Construction Bidding Process
          </p>
        </div>

        {/* Main Action Buttons */}
        <div className="space-y-4 mb-8">
          {/* Download Contact Info */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 border-gray-200 hover:border-orange hover:scale-[1.02]">
            <CardContent className="p-0">
              <Button
                onClick={generateVCard}
                variant="ghost"
                className="w-full h-auto py-6 px-6 flex items-center justify-between hover:bg-orange/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bidi-orange-bg-light rounded-xl flex items-center justify-center shadow-md">
                    <Download className="w-6 h-6 bidi-orange-text" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-black text-lg">
                      Download Contact Info
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      Save to your contacts
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400" />
              </Button>
            </CardContent>
          </Card>

          {/* Learn About Bidi Contracting */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 border-gray-200 hover:border-orange hover:scale-[1.02]">
            <CardContent className="p-0">
              <a
                href="https://bidicontracting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  variant="ghost"
                  className="w-full h-auto py-6 px-6 flex items-center justify-between hover:bg-orange/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bidi-orange-bg-light rounded-xl flex items-center justify-center shadow-md">
                      <img src={contactInfo.image} alt="Bidi Contracting" className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-black text-lg">
                        Learn About Bidi Contracting
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        Visit our website
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* About Section */}
        <Card className="border-2 border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-black mb-3 tracking-tight">
              About Us
            </h2>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-6 font-medium">
              Bidi Contracting is a modern construction management platform that streamlines 
              the bidding process for general contractors and subcontractors. Our platform 
              helps you collect, compare, and manage bids efficiently, saving time and 
              improving project outcomes.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <Phone className="w-5 h-5 bidi-orange-text" />
                <a href={`tel:${contactInfo.phone}`} className="bidi-orange-text hover:underline font-semibold flex-1">
                  {contactInfo.phone}
                </a>
                <a href={`tel:${contactInfo.phone}`} className="bg-orange text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-orange/90 transition-colors">
                  Call Now
                </a>
              </div>
              <div className="flex items-center justify-between gap-3 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <Mail className="w-5 h-5 bidi-orange-text" />
                <a href={`mailto:${contactInfo.email}`} className="bidi-orange-text hover:underline font-semibold flex-1">
                  {contactInfo.email}
                </a>
                <a href={`mailto:${contactInfo.email}`} className="bg-orange text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-orange/90 transition-colors">
                  Email Us
                </a>
              </div>
              <div className="flex items-center justify-between gap-3 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <Globe className="w-5 h-5 bidi-orange-text" />
                <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="bidi-orange-text hover:underline font-semibold flex-1">
                  {contactInfo.website}
                </a>
                <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="bg-orange text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-orange/90 transition-colors">
                  Visit Website
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

