import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCircuitStore } from "@/stores/circuit-store";
import { useToast } from "@/hooks/use-toast";

export default function ImportExportModal() {
  const { isImportModalOpen, setImportModalOpen, importCircuit } = useCircuitStore();
  const [jsonInput, setJsonInput] = useState("");
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to read file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    try {
      const circuitData = JSON.parse(jsonInput);
      importCircuit(circuitData);
      setImportModalOpen(false);
      setJsonInput("");
      toast({
        title: "Success",
        description: "Circuit imported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON format",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setImportModalOpen(false);
    setJsonInput("");
  };

  return (
    <Dialog open={isImportModalOpen} onOpenChange={setImportModalOpen}>
      <DialogContent className="w-full max-w-md" data-testid="import-modal">
        <DialogHeader>
          <DialogTitle>Import Circuit</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Upload JSON File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              data-testid="input-file-upload"
            />
          </div>
          
          <div>
            <Label htmlFor="json-input">Or Paste JSON</Label>
            <Textarea
              id="json-input"
              rows={6}
              placeholder="Paste circuit JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="font-mono text-sm resize-none"
              data-testid="textarea-json-input"
            />
          </div>
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!jsonInput.trim()}
              data-testid="button-confirm-import"
            >
              Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
