import JSZip from 'jszip';
import type { EpubMetadata, StoredEpub } from './db';

export async function rebuildEpubWithMetadata(storedEpub: StoredEpub): Promise<Blob> {
    try {
        // Load the original EPUB
        const zip = await JSZip.loadAsync(storedEpub.data);
        const parser = new DOMParser();

        // Get the OPF file path from container.xml
        const containerFile = zip.files['META-INF/container.xml'];
        const containerFileText = await containerFile.async('text');
        const parsedCF = parser.parseFromString(containerFileText, 'application/xml');
        const ns = 'urn:oasis:names:tc:opendocument:xmlns:container';
        const rootfileElement = parsedCF.getElementsByTagNameNS(ns, 'rootfile')[0];
        const opfPath = rootfileElement.getAttribute('full-path');

        if (!opfPath) {
            throw new Error('Invalid EPUB file - no OPF path found');
        }

        // Get and parse the OPF file
        const opfFile = zip.files[opfPath];
        const opfData = await opfFile.async('text');
        const opfDoc = parser.parseFromString(opfData, 'application/xml');

        // Update the metadata in the OPF file
        updateOpfMetadata(opfDoc, storedEpub.metadata);

        // If there's a new cover, update it
        if (storedEpub.coverBlob && storedEpub.metadata.coverPath) {
            zip.file(storedEpub.metadata.coverPath, storedEpub.coverBlob);
        }

        // Serialize the updated OPF back to string
        const serializer = new XMLSerializer();
        const updatedOpfData = serializer.serializeToString(opfDoc);

        // Replace the OPF file in the zip
        zip.file(opfPath, updatedOpfData);

        // Generate the new EPUB blob
        const newEpubBlob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        });

        return newEpubBlob;

    } catch (error) {
        console.error('Error rebuilding EPUB:', error);
        throw new Error(`Failed to rebuild EPUB: ${error}`);
    }
}

function updateOpfMetadata(opfDoc: Document, metadata: EpubMetadata): void {
    const nsResolver = (prefix: string | null): string | null => {
        const ns: Record<string, string> = {
            dc: 'http://purl.org/dc/elements/1.1/',
            opf: 'http://www.idpf.org/2007/opf',
            dcterms: 'http://purl.org/dc/terms/'
        };
        return ns[prefix!] || null;
    };

    // Helper function to update or create element
    function updateElement(xpath: string, value: string, tagName: string, namespace: string): void {
        const result = opfDoc.evaluate(xpath, opfDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);

        if (result.singleNodeValue) {
            // Update existing element
            result.singleNodeValue.textContent = value;
        } else {
            // Create new element
            const metadataElement = opfDoc.evaluate('//opf:metadata', opfDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (metadataElement) {
                const newElement = opfDoc.createElementNS(namespace, tagName);
                newElement.textContent = value;
                metadataElement.appendChild(newElement);
            }
        }
    }

    // Update basic metadata
    updateElement('//dc:title', metadata.title, 'dc:title', 'http://purl.org/dc/elements/1.1/');
    updateElement('//dc:creator', metadata.author, 'dc:creator', 'http://purl.org/dc/elements/1.1/');
    updateElement('//dc:description', metadata.description, 'dc:description', 'http://purl.org/dc/elements/1.1/');
    updateElement('//dc:language', metadata.language, 'dc:language', 'http://purl.org/dc/elements/1.1/');
    updateElement('//dc:publisher', metadata.publisher, 'dc:publisher', 'http://purl.org/dc/elements/1.1/');

    // Update identifiers
    updateIdentifiers(opfDoc, metadata.identifiers, nsResolver);

    // Update subjects
    updateSubjects(opfDoc, metadata.subjects, nsResolver);
}

function updateIdentifiers(opfDoc: Document, identifiers: Record<string, string>, nsResolver: XPathNSResolver): void {
    // Remove existing identifiers (except unique-identifier if it exists)
    const metadataElement = opfDoc.evaluate('//opf:metadata', opfDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const packageElement = opfDoc.evaluate('//opf:package', opfDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as Element;
    const uniqueIdentifierId = packageElement?.getAttribute('unique-identifier');

    if (metadataElement) {
        // Get all identifier elements
        const identifierResult = opfDoc.evaluate('//dc:identifier', opfDoc, nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        const identifiersToRemove: Node[] = [];

        let node = identifierResult.iterateNext();
        while (node) {
            const element = node as Element;
            const id = element.getAttribute('id');

            // Don't remove the unique identifier
            if (!uniqueIdentifierId || id !== uniqueIdentifierId) {
                identifiersToRemove.push(node);
            }
            node = identifierResult.iterateNext();
        }

        // Remove non-unique identifiers
        identifiersToRemove.forEach(node => {
            metadataElement.removeChild(node);
        });

        // Add new identifiers
        Object.entries(identifiers).forEach(([scheme, value]) => {
            if (value) {
                const identifierElement = opfDoc.createElementNS('http://purl.org/dc/elements/1.1/', 'dc:identifier');
                identifierElement.textContent = value;

                // Map scheme back to standard format
                const standardScheme = mapSchemeToStandard(scheme);
                identifierElement.setAttributeNS('http://www.idpf.org/2007/opf', 'opf:scheme', standardScheme);

                metadataElement.appendChild(identifierElement);
            }
        });
    }
}

function mapSchemeToStandard(scheme: string): string {
    const schemeMap: Record<string, string> = {
        'asin': 'ASIN',
        'amzn': 'AMAZON',
        'isbn': 'ISBN',
        'isbn13': 'ISBN',
        'google': 'GOOGLE',
        'goodreads': 'GOODREADS',
        'lccn': 'LCCN',
        'oclc': 'OCLC',
        'dewey': 'DEWEY',
        'doi': 'DOI',
        'pmid': 'PMID',
        'uuid': 'UUID',
        'uri': 'URI',
        'apple': 'APPLE',
        'kobo': 'KOBO',
        'bn': 'BN',
        'gutenberg': 'GUTENBERG',
        'calibre': 'CALIBRE'
    };

    return schemeMap[scheme.toLowerCase()] || scheme.toUpperCase();
}

function updateSubjects(opfDoc: Document, subjects: string[], nsResolver: XPathNSResolver): void {
    const metadataElement = opfDoc.evaluate('//opf:metadata', opfDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    if (metadataElement) {
        // Remove existing subjects
        const subjectResult = opfDoc.evaluate('//dc:subject', opfDoc, nsResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        const subjectsToRemove: Node[] = [];

        let node = subjectResult.iterateNext();
        while (node) {
            subjectsToRemove.push(node);
            node = subjectResult.iterateNext();
        }

        subjectsToRemove.forEach(node => {
            metadataElement.removeChild(node);
        });

        // Add new subjects
        subjects.forEach(subject => {
            if (subject) {
                const subjectElement = opfDoc.createElementNS('http://purl.org/dc/elements/1.1/', 'dc:subject');
                subjectElement.textContent = subject;
                metadataElement.appendChild(subjectElement);
            }
        });
    }
}

// Usage function to update EPUB in IndexedDB
export async function updateEpubInDatabase(db: any, storedEpub: StoredEpub): Promise<void> {
    try {
        // Rebuild the EPUB with updated metadata
        const newEpubBlob = await rebuildEpubWithMetadata(storedEpub);

        // Update the stored epub object
        const updatedEpub: StoredEpub = {
            ...storedEpub,
            data: newEpubBlob,
            // Update timestamp to reflect the modification
            createdAt: new Date()
        };

        // Save back to IndexedDB
        if (updatedEpub.id) {
            await db.epubs.put(updatedEpub);
        } else {
            const newId = await db.epubs.add(updatedEpub);
            updatedEpub.id = newId;
        }


    } catch (error) {
        console.error('Failed to update EPUB in database:', error);
        throw error;
    }
}