interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob(): Promise<Blob>;
}

interface FontDataQueryOptions {
  postscriptNames?: string[];
}

interface Navigator {
  fonts?: {
    query(options?: FontDataQueryOptions): Promise<FontData[]>;
  };
}
