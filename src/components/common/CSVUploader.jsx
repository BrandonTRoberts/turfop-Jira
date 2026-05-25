import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function CSVUploader({ onImport, title = "Import CSV", mappingExample }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccessCount(0);
      
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Error parsing CSV: ${results.errors[0].message}`);
          } else {
            setParsedData(results.data);
          }
        },
        error: (err) => {
          setError(`Error parsing CSV: ${err.message}`);
        }
      });
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      await onImport(parsedData);
      setSuccessCount(parsedData.length);
      setParsedData([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.message || 'Import failed. Please check your data format.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 flex flex-col items-center text-center">
      {!file && !successCount && (
        <>
          <div className="bg-white p-3 rounded-full shadow-sm mb-3">
            <Upload className="w-6 h-6 text-gray-500" />
          </div>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
            Select a CSV file to bulk import records.
            {mappingExample && <span className="block mt-2 font-mono text-xs bg-gray-200 p-1 rounded">Expected columns: {mappingExample}</span>}
          </p>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="hidden" 
            ref={fileInputRef}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Browse Files
          </Button>
        </>
      )}

      {file && parsedData.length > 0 && !successCount && (
        <div className="w-full">
          <div className="flex items-center justify-between bg-white p-4 rounded border mb-4">
            <div className="flex items-center">
              <FileUp className="w-5 h-5 text-blue-500 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{parsedData.length} records found</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setParsedData([]); }} disabled={isProcessing}>
              Cancel
            </Button>
          </div>
          <Button 
            className="w-full" 
            onClick={handleImport} 
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
            ) : (
              `Import ${parsedData.length} Records`
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded flex items-start text-left text-sm w-full">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successCount > 0 && (
        <div className="flex flex-col items-center">
          <div className="bg-green-100 p-3 rounded-full mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-800">Import Successful</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Successfully imported {successCount} records.</p>
          <Button variant="outline" onClick={() => setSuccessCount(0)}>
            Import Another File
          </Button>
        </div>
      )}
    </div>
  );
}
