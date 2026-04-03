from pydantic import BaseModel


class CityOption(BaseModel):
    id: int
    name_uk: str
    name_en: str
    oblast: str
    label: str
