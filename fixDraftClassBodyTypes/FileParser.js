class FileParser 
{
    constructor(buffer) 
    {
        this._buffer = buffer;
        this._offset = 0;
    }

    get buffer()
    {
        return this._buffer;
    }

    set buffer(buffer)
    {
        this._buffer = buffer;
        this._offset = 0;
    }

    get offset()
    {
        return this._offset;
    }

    set offset(offset)
    {
        this._offset = offset;
    }

    readBytes(length) 
    {
        const bytes = this._buffer.subarray(this._offset, this._offset + length);
        this._offset += length;
        return bytes;
    }

    readByte()
    {
        return this._buffer.subarray(this._offset++, this._offset);
    }

    readUShort(bigEndian = false)
    {
        const value = bigEndian ? this._buffer.readUInt16BE(this._offset) : this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        return value;
    }

    readUInt(bigEndian = false)
    {
        const value = bigEndian ? this._buffer.readUInt32BE(this._offset) : this._buffer.readUInt32LE(this._offset);
        this._offset += 4;
        return value;
    }

    readNullTerminatedString()
    {
        let string = "";

        while(this._buffer[this._offset] !== 0)
        {
            string += String.fromCharCode(this._buffer[this._offset++]);
        }

        this._offset++;

        return string;
    }

    readSizedString(length)
    {
        // Read the next length bytes as a string, adding each byte to the string if it's not null
        let string = "";

        for(let i = 0; i < length; i++)
        {
            const byte = this._buffer[this._offset++];

            if(byte !== 0)
            {
                string += String.fromCharCode(byte);
            }
        }

        return string;
    }


    pad(alignment)
	{
		while(this._offset % alignment !== 0)
		{
			this._offset++;
		}
	}

};

module.exports = {
    FileParser
};